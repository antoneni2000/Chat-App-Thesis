package com.chatapp.controller;

import com.chatapp.dto.MessageDto;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.MessageSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@Slf4j
public class MessageSearchController {

    private final MessageSearchService messageSearchService;
    private final UserRepository userRepository;

    /**
     * cauta mesaje text intr-un chat specific
     */
    @GetMapping("/search")
    public ResponseEntity<List<MessageDto>> searchInChat(
            @RequestParam Long chatId,
            @RequestParam String query) {
        log.info("Search request in chat {}: {}", chatId, query);
        return ResponseEntity.ok(messageSearchService.searchInChat(chatId, query));
    }

    /**
     * cauta mesaje in TOATE chaturile utilizatorului
     */
    @GetMapping("/search-all")
    public ResponseEntity<List<MessageDto>> searchInAllChats(@RequestParam String query) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        log.info("Search request in all chats for user {}: {}", user.getId(), query);
        return ResponseEntity.ok(messageSearchService.searchInAllMyChats(user.getId(), query));
    }

    /**
     * marcare mesaj ca citit read
     */
    @PostMapping("/{messageId}/mark-read")
    public ResponseEntity<MessageDto> markAsRead(@PathVariable Long messageId) {
        log.info("Mark message {} as read", messageId);
        return ResponseEntity.ok(messageSearchService.markMessageAsRead(messageId));
    }

    /**
     * mcrcare mesaj ca livrat delivered
     */
    @PostMapping("/{messageId}/mark-delivered")
    public ResponseEntity<MessageDto> markAsDelivered(@PathVariable Long messageId) {
        log.info("Mark message {} as delivered", messageId);
        return ResponseEntity.ok(messageSearchService.markMessageAsDelivered(messageId));
    }
}
