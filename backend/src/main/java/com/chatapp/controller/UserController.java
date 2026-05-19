package com.chatapp.controller;

import com.chatapp.dto.UpdateProfileRequest;
import com.chatapp.dto.UserDto;
import com.chatapp.entity.Chat;
import com.chatapp.entity.ChatMember;
import com.chatapp.entity.Message;
import com.chatapp.entity.User;
import com.chatapp.repository.ChatMemberRepository;
import com.chatapp.repository.ChatRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import com.chatapp.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final MessageRepository messageRepository;
    private final SecurityUtils securityUtils;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(securityUtils.getCurrentUser());
    }

    @GetMapping
    public List<UserDto> listAll() {
        User me = securityUtils.getCurrentUser();
        return userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(me.getId()))
                .map(UserDto::from)
                .toList();
    }

    /**
     * PATCH /api/users/me — update displayName, email si/sau avatar.
     */
    @PatchMapping("/me")
    public ResponseEntity<?> updateMe(@Valid @RequestBody UpdateProfileRequest req) {
        User me = securityUtils.getCurrentUser();

        if (req.displayName() != null && !req.displayName().isBlank()) {
            me.setDisplayName(req.displayName().trim());
        }

        if (req.email() != null && !req.email().isBlank() && !req.email().equals(me.getEmail())) {
            // verifica daca email-ul e deja folosit
            if (userRepository.existsByEmail(req.email())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email already used by another user"));
            }
            me.setEmail(req.email().trim().toLowerCase());
        }

        if (req.avatarUrl() != null) {
            me.setAvatarUrl(req.avatarUrl().isBlank() ? null : req.avatarUrl());
        }

        me = userRepository.save(me);
        UserDto dto = UserDto.from(me);
        messagingTemplate.convertAndSend("/topic/presence", dto);
        return ResponseEntity.ok(dto);
    }

    /**
     * DELETE /api/users/me — sterge contul si toate datele asociate.
     */
    @DeleteMapping("/me")
    @Transactional
    public Map<String, Object> deleteMe() {
        User me = securityUtils.getCurrentUser();
        Long myId = me.getId();

        // 1. Sterge mesajele trimise de mine (FK sender_id)
        List<Chat> myChats = chatRepository.findVisibleChatsForUser(myId);
        for (Chat c : myChats) {
            // sterge mesajele MELE din chaturile in care sunt
            messageRepository.findByChatIdOrderByCreatedAtAsc(c.getId()).stream()
                    .filter(m -> m.getSender().getId().equals(myId))
                    .forEach(messageRepository::delete);
        }
        // pentru DIRECT chats: stergem complet (chat + mesajele celuilalt + membri)
        for (Chat c : myChats) {
            if (c.getType() == Chat.ChatType.DIRECT) {
                messageRepository.findByChatIdOrderByCreatedAtAsc(c.getId()).forEach(messageRepository::delete);
                chatMemberRepository.findByChatId(c.getId()).forEach(chatMemberRepository::delete);
                chatRepository.delete(c);
            }
        }
        // pentru GROUP chats: doar scoatem userul din lista membrilor
        chatMemberRepository.findAll().stream()
                .filter(cm -> cm.getUser().getId().equals(myId))
                .forEach(chatMemberRepository::delete);

        // 2. Sterge userul
        userRepository.delete(me);

        return Map.of("deleted", true);
    }
}
