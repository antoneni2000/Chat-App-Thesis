package com.chatapp.dto;

public record MarkMessageReadRequest(
    Long messageId,
    Long chatId
) {}
