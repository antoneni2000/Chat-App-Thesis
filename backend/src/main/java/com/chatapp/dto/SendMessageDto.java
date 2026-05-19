package com.chatapp.dto;

/**
 * Ce trimite clientul prin WebSocket cand vrea sa trimita mesaj nou.
 * - content: textul (poate fi gol daca e doar atasament)
 * - attachmentUrl: data URL base64 (poate lipsi)
 */
public record SendMessageDto(
    Long chatId,
    String content,
    String attachmentUrl,
    String attachmentName,
    String attachmentType
) {}
