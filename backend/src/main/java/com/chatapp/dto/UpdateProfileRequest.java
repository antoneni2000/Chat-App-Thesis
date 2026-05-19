package com.chatapp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
    @Size(max = 100) String displayName,
    @Email String email,
    String avatarUrl
) {}
