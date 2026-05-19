package com.chatapp.dto;

import com.chatapp.entity.Chat;

import java.time.LocalDateTime;
import java.util.List;

public record ChatDto(
    Long id,
    String type,
    String name,
    UserDto otherUser,
    List<UserDto> members,
    LocalDateTime createdAt,
    MessageDto lastMessage,
    long unreadCount
) {
    public static ChatDto direct(Chat chat, UserDto otherUser, List<UserDto> members, MessageDto lastMessage, long unreadCount) {
        return new ChatDto(chat.getId(), "DIRECT", null, otherUser, members, chat.getCreatedAt(), lastMessage, unreadCount);
    }

    public static ChatDto group(Chat chat, List<UserDto> members, MessageDto lastMessage, long unreadCount) {
        return new ChatDto(chat.getId(), "GROUP", chat.getName(), null, members, chat.getCreatedAt(), lastMessage, unreadCount);
    }
}
