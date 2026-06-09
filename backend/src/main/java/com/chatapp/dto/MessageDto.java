package com.chatapp.dto;

import com.chatapp.entity.Message;
import com.chatapp.entity.MessageDeliveryStatus;

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
    LocalDateTime createdAt,
    MessageDeliveryStatus deliveryStatus,
    LocalDateTime deliveredAt,
    LocalDateTime readAt
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
            m.getCreatedAt(),
            m.getDeliveryStatus(),
            m.getDeliveredAt(),
            m.getReadAt()
        );
    }

    /**
     * Returneaza o copie cu attachmentUrl inlocuit (folosit ca sa pompam URL
     * proaspat semnat din GCS in fiecare DTO trimis la client).
     */
    public MessageDto withAttachmentUrl(String url) {
        return new MessageDto(
            id, chatId, senderId, senderUsername, senderDisplayName,
            content, url, attachmentName, attachmentType,
            createdAt, deliveryStatus, deliveredAt, readAt
        );
    }
}
