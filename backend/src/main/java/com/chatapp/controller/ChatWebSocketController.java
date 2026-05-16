package com.chatapp.controller;

import com.chatapp.dto.MessageDto;
import com.chatapp.dto.SendMessageDto;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Controller pentru WebSocket/STOMP.
 * Toate mesajele primite pe "/app/chat.send" sunt salvate în DB si apoi
 * trimise tuturor abonatilor la "/topic/chat/{chatId}".
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ChatService chatService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload SendMessageDto dto, Principal principal) {
        if (principal == null) {
            log.warn("WebSocket message without authenticated user");
            return;
        }

        // principal.getName() = email-ul setat in WebSocketAuthInterceptor (la CONNECT)
        User sender = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalStateException("Sender not found"));

        MessageDto saved = chatService.sendMessage(sender, dto.chatId(), dto.content());

        // Broadcast la toti din acest chat
        messagingTemplate.convertAndSend("/topic/chat/" + dto.chatId(), saved);
    }
}
