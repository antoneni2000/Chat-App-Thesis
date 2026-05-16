package com.chatapp.dto;

/**
 * Ce trimite clientul prin WebSocket cand vrea sa trimita msj nou
 */
public record SendMessageDto(
    Long chatId,
    String content
) {}
