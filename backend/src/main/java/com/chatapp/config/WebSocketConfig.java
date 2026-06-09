package com.chatapp.config;

import com.chatapp.security.WebSocketAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

/**
 * config WebSocket + STOMP.
 *
 *  - endpoint de handshake: /ws (clientul se conecteaza aici cu SockJS)
 *  - destinatii server -> client (subscribe): /topic/...
 *  - destinatii client -> server (send): /app/...
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor authInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // broker simplu, in-memory
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")  // accept dev origins
                .withSockJS();                  // fallback daca browserul nu suporta WS direct
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Interceptorul care citește JWT din frame-ul CONNECT
        registration.interceptors(authInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        // marim limitele ca sa incapa base64-uri mari (poze/documente)
        registry.setMessageSizeLimit(10 * 1024 * 1024);      // 10 MB / mesaj
        registry.setSendBufferSizeLimit(10 * 1024 * 1024);
        registry.setSendTimeLimit(20_000);
    }
}
