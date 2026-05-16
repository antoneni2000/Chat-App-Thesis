package com.chatapp.dto;

import com.chatapp.entity.Message;

import java.time.LocalDateTime;

/**
 * Un mesaj trimis la frontend.
 */
public record MessageDto(
    Long id,
    Long chatId,
    Long senderId,
    String senderUsername,
    String senderDisplayName,
    String content,
    LocalDateTime createdAt
) {
    public static MessageDto from(Message m) {
        return new MessageDto(
            m.getId(),
            m.getChat().getId(),
            m.getSender().getId(),
            m.getSender().getUsername(),
            m.getSender().getDisplayName(),
            m.getContent(),
            m.getCreatedAt()
        );
    }
}
