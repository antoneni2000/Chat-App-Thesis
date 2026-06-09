package com.chatapp.dto;

public record TypingIndicatorDto(
    Long userId,
    String username,
    Long chatId,
    boolean isTyping
) {}
