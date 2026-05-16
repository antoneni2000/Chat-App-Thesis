package com.chatapp.dto;

import com.chatapp.entity.Chat;

import java.time.LocalDateTime;
import java.util.List;

/**
 * chat trimis front
 * - pentru 1 -1 : name e null, dar otherUser conttine celalalt user
 * - pentru grup: name contine numele grupului, members contine toti membrii
 */
public record ChatDto(
    Long id,
    String type,           // dricet sau group
    String name,
    UserDto otherUser,     // pentru direct chat (null pentru GROUP)
    List<UserDto> members,
    LocalDateTime createdAt
) {
    public static ChatDto direct(Chat chat, UserDto otherUser, List<UserDto> members) {
        return new ChatDto(chat.getId(), "DIRECT", null, otherUser, members, chat.getCreatedAt());
    }

    public static ChatDto group(Chat chat, List<UserDto> members) {
        return new ChatDto(chat.getId(), "GROUP", chat.getName(), null, members, chat.getCreatedAt());
    }
}
