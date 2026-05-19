package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * User al aplicatiei.
 * Tabel: users
 */
@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(unique = true, nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name", length = 100)
    private String displayName;

    // avatar stocat ca data URL base64 (e.g. "data:image/png;base64,...").
    // TEXT in DB ca sa incapa imagini de zeci de KB
    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    // pentru prezenta (nullable ca să nu pice updateul pe rândurile existente)
    @Column
    private Boolean online;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
