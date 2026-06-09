package com.chatapp.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Ce trimite frontend-ul dupa ce userul s-a logat cu Google.
 * idToken = JWT semnat de Google, contine email + nume + poza.
 * Backend-ul verifica semnatura Google si extrage datele.
 */
public record GoogleLoginRequest(
    @NotBlank String idToken
) {}
