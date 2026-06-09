package com.chatapp.config;

import com.chatapp.dto.UserDto;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.LocalDateTime;

/**
 * asculta connect/disconnect WS si actualizeaza online/utlima activitate
 */
@Component
@RequiredArgsConstructor
public class PresenceListener {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    @Transactional
    public void onConnect(SessionConnectedEvent event) {
        Principal user = event.getUser();
        if (user == null) return;
        String email = user.getName();
        userRepository.findByEmail(email).ifPresent(u -> {
            u.setOnline(true);
            userRepository.save(u);
            messagingTemplate.convertAndSend("/topic/presence", UserDto.from(u));
        });
    }

    @EventListener
    @Transactional
    public void onDisconnect(SessionDisconnectEvent event) {
        Principal user = event.getUser();
        if (user == null) return;
        String email = user.getName();
        userRepository.findByEmail(email).ifPresent(u -> {
            u.setOnline(false);
            u.setLastSeenAt(LocalDateTime.now());
            userRepository.save(u);
            messagingTemplate.convertAndSend("/topic/presence", UserDto.from(u));
        });
    }
}
