package com.chatapp.dto;

public record SearchMessagesRequest(
    Long chatId,  // null = search in all my chats
    String query
) {}
