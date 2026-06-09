package com.chatapp.dto;

/**
 * ce trimite backend inapoi dupa registr/sign in
 */
public record AuthResponse(
    String token,
    Long userId,
    String username,
    String email,
    String displayName,
    String avatarUrl
) {}
