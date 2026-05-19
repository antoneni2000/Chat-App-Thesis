package com.chatapp.dto;

import com.chatapp.entity.Message;

import java.time.LocalDateTime;

public record MessageDto(
    Long id,
    Long chatId,
    Long senderId,
    String senderUsername,
    String senderDisplayName,
    String content,
    String attachmentUrl,
    String attachmentName,
    String attachmentType,
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
            m.getAttachmentUrl(),
            m.getAttachmentName(),
            m.getAttachmentType(),
            m.getCreatedAt()
        );
    }
}
