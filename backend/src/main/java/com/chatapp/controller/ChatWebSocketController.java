package com.chatapp.controller;

import com.chatapp.dto.MessageDto;
import com.chatapp.dto.SendMessageDto;
import com.chatapp.dto.TypingIndicatorDto;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.ChatService;
import com.chatapp.service.MessageSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * WebSocket/STOMP controller.
 * Primeste mesajele si broadcast-eaza pe /topic/chat/{id}.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ChatService chatService;
    private final MessageSearchService messageSearchService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload SendMessageDto dto, Principal principal) {
        if (principal == null) {
            log.warn("WebSocket message without authenticated user");
            return;
        }
        User sender = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalStateException("Sender not found"));
        MessageDto saved = chatService.sendMessage(
                sender, dto.chatId(), dto.content(),
                dto.attachmentUrl(), dto.attachmentName(), dto.attachmentType());

        // ChatService.sendMessage marcheaza deja mesajul ca DELIVERED.
        // broadcast mesajul la cei care vad chatul deschis
        messagingTemplate.convertAndSend("/topic/chat/" + dto.chatId(), saved);
    }

    /**
     * Handle typing indicator - broadcasat pe /topic/chat/{chatId}/typing
     */
    @MessageMapping("/chat.typing")
    public void sendTypingIndicator(@Payload TypingIndicatorDto dto, Principal principal) {
        if (principal == null) {
            log.warn("WebSocket typing without authenticated user");
            return;
        }
        
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        
        // Broadcasat la toti care vad chatul deschis
        messagingTemplate.convertAndSend("/topic/chat/" + dto.chatId() + "/typing", dto);
        
        log.debug("Typing indicator from user {} in chat {}", user.getId(), dto.chatId());
    }
}
