package com.chatapp.dto;

import com.chatapp.entity.User;
import com.chatapp.entity.UserStatus;

import java.time.LocalDateTime;

/**
 * info publice ale unui user
 */
public record UserDto(
    Long id,
    String username,
    String email,
    String displayName,
    String avatarUrl,
    boolean online,
    LocalDateTime lastSeenAt,
    UserStatusDto status
) {
    /** Returneaza o copie cu avatarUrl inlocuit (pentru Signed URL proaspat). */
    public UserDto withAvatarUrl(String newAvatarUrl) {
        return new UserDto(id, username, email, displayName, newAvatarUrl, online, lastSeenAt, status);
    }

    public static UserDto from(User u) {
        // status e @OneToOne(fetch = LAZY) — daca user-ul a fost incarcat intr-o
        // tranzactie inchisa, accesul declanseaza LazyInitializationException.
        // Inghitim exceptia ca sa nu cada endpoint-urile care produc UserDto in afara unei tranzactii.
        UserStatusDto statusDto = null;
        try {
            UserStatus s = u.getStatus();
            statusDto = (s != null) ? UserStatusDto.from(s) : null;
        } catch (Exception ignored) {
            // lazy-load esuat (sesiune inchisa); lasam status null
        }

        return new UserDto(
            u.getId(),
            u.getUsername(),
            u.getEmail(),
            u.getDisplayName(),
            u.getAvatarUrl(),
            Boolean.TRUE.equals(u.getOnline()),  // null → false
            u.getLastSeenAt(),
            statusDto
        );
    }
}
