package com.chatapp.dto;

import com.chatapp.entity.User;

import java.time.LocalDateTime;

/**
 * Info publice ale unui user.
 * Nu includem password_hash.
 */
public record UserDto(
    Long id,
    String username,
    String email,
    String displayName,
    String avatarUrl,
    boolean online,
    LocalDateTime lastSeenAt
) {
    public static UserDto from(User u) {
        return new UserDto(
            u.getId(),
            u.getUsername(),
            u.getEmail(),
            u.getDisplayName(),
            u.getAvatarUrl(),
            Boolean.TRUE.equals(u.getOnline()),  // null → false
            u.getLastSeenAt()
        );
    }
}
