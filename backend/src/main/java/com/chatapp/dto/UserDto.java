package com.chatapp.dto;

import com.chatapp.entity.User;

/**
 * info publice ale unui user, ce trimitem la front
 * obv, nu includem pass hash
 */
public record UserDto(
    Long id,
    String username,
    String email,
    String displayName
) {
    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName());
    }
}
