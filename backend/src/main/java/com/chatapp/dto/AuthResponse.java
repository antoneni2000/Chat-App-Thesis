package com.chatapp.dto;

/**
 * ce trimite backend inapoi dupa registr/sigm in
 * token = JWT-ul pe care frontend-ul il va folosi in cererile urmatoare
 */
public record AuthResponse(
    String token,
    Long userId,
    String username,
    String email,
    String displayName
) {}
