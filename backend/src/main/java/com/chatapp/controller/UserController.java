package com.chatapp.controller;

import com.chatapp.dto.UpdateProfileRequest;
import com.chatapp.dto.UserDto;
import com.chatapp.entity.Chat;
import com.chatapp.entity.User;
import com.chatapp.repository.ChatMemberRepository;
import com.chatapp.repository.ChatRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import com.chatapp.security.SecurityUtils;
import com.chatapp.service.FileStorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final MessageRepository messageRepository;
    private final SecurityUtils securityUtils;
    private final SimpMessagingTemplate messagingTemplate;
    private final FileStorageService fileStorageService;

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public UserDto me() {
        User me = securityUtils.getCurrentUser();
        UserDto dto = UserDto.from(me);
        // regenereaza URL-ul avatarului dacă e un GCS object key
        if (dto.avatarUrl() != null && !dto.avatarUrl().startsWith("data:") && !dto.avatarUrl().startsWith("http")) {
            return dto.withAvatarUrl(fileStorageService.freshUrlFor(dto.avatarUrl()));
        }
        return dto;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<UserDto> listAll() {
        User me = securityUtils.getCurrentUser();
        return userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(me.getId()))
                .map(u -> {
                    UserDto dto = UserDto.from(u);
                    if (dto.avatarUrl() != null && !dto.avatarUrl().startsWith("data:") && !dto.avatarUrl().startsWith("http")) {
                        return dto.withAvatarUrl(fileStorageService.freshUrlFor(dto.avatarUrl()));
                    }
                    return dto;
                })
                .toList();
    }

    /**
     * PATCH /api/users/me — update displayName si/sau email.
     */
    @PatchMapping("/me")
    public ResponseEntity<?> updateMe(@Valid @RequestBody UpdateProfileRequest req) {
        User me = securityUtils.getCurrentUser();

        if (req.displayName() != null && !req.displayName().isBlank()) {
            me.setDisplayName(req.displayName().trim());
        }

        if (req.email() != null && !req.email().isBlank() && !req.email().equals(me.getEmail())) {
            if (userRepository.existsByEmail(req.email())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email already used by another user"));
            }
            me.setEmail(req.email().trim().toLowerCase());
        }

        // avatarUrl null = nu-l atinge; blank = sterge avatarul
        if (req.avatarUrl() != null) {
            if (req.avatarUrl().isBlank()) {
                deleteOldAvatar(me.getAvatarUrl());
                me.setAvatarUrl(null);
            }
        }

        me = userRepository.save(me);
        UserDto dto = UserDto.from(me);
        messagingTemplate.convertAndSend("/topic/presence", dto);
        return ResponseEntity.ok(dto);
    }

    /**
     * POST /api/users/me/avatar — upload avatar nou in GCS.
     * inlocuieste logica cu FileReader.readAsDataURL din frontend:
     * trimite fisierul direct, primesti URL Signed inapoi.
     */
    @PostMapping("/me/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only image files are allowed"));
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "Avatar too large (max 5MB)"));
        }

        try {
            User me = securityUtils.getCurrentUser();
            // Sterge avatarul vechi din GCS (daca exista si e GCS)
            deleteOldAvatar(me.getAvatarUrl());

            // Upload nou avatar si salveaza object key in DB
            String objectKey = fileStorageService.uploadAvatar(file);
            me.setAvatarUrl(objectKey);
            me = userRepository.save(me);

            // Returneaza Signed URL proaspat pentru preview imediat
            String freshUrl = fileStorageService.freshUrlFor(objectKey);
            UserDto dto = UserDto.from(me).withAvatarUrl(freshUrl);
            messagingTemplate.convertAndSend("/topic/presence", dto);
            return ResponseEntity.ok(dto);
        } catch (Exception ex) {
            log.error("Avatar upload failed: {}", ex.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * DELETE /api/users/me/avatar — sterge avatarul curent.
     */
    @DeleteMapping("/me/avatar")
    public ResponseEntity<?> deleteAvatar() {
        User me = securityUtils.getCurrentUser();
        deleteOldAvatar(me.getAvatarUrl());
        me.setAvatarUrl(null);
        me = userRepository.save(me);
        UserDto dto = UserDto.from(me);
        messagingTemplate.convertAndSend("/topic/presence", dto);
        return ResponseEntity.ok(dto);
    }

    /** Sterge un avatar vechi din GCS daca e un object key (nu URL extern / base64). */
    private void deleteOldAvatar(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) return;
        if (avatarUrl.startsWith("data:")) return;   // base64 vechi — nu e in GCS
        if (avatarUrl.startsWith("https://lh3.googleusercontent.com")) return; // Google OAuth avatar
        try {
            String key = avatarUrl.startsWith("http") ? fileStorageService.extractObjectNameFromUrl(avatarUrl) : avatarUrl;
            if (key != null) fileStorageService.deleteByKey(key);
        } catch (Exception e) {
            log.warn("Could not delete old avatar: {}", e.getMessage());
        }
    }

    /**
     * DELETE /api/users/me — sterge contul si toate datele asociate.
     */
    @DeleteMapping("/me")
    @Transactional
    public Map<String, Object> deleteMe() {
        User me = securityUtils.getCurrentUser();
        Long myId = me.getId();

        // sterge avatarul din GCS
        deleteOldAvatar(me.getAvatarUrl());

        List<Chat> myChats = chatRepository.findVisibleChatsForUser(myId);
        for (Chat c : myChats) {
            if (c.getType() == Chat.ChatType.DIRECT) {
                messageRepository.findByChatIdAndDeletedFalseOrderByCreatedAtAsc(c.getId())
                        .forEach(messageRepository::delete);
                chatMemberRepository.findByChatId(c.getId()).forEach(chatMemberRepository::delete);
                chatRepository.delete(c);
            } else {
                messageRepository.findByChatIdAndDeletedFalseOrderByCreatedAtAsc(c.getId()).stream()
                        .filter(m -> m.getSender().getId().equals(myId))
                        .forEach(messageRepository::delete);
            }
        }

        chatMemberRepository.deleteByUserId(myId);
        userRepository.delete(me);

        return Map.of("deleted", true);
    }
}
