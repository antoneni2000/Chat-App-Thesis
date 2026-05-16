package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A chat, 1-on-1 or a multi-user, group,  conversation.
 * Tabel: chats
 */
@Entity
@Table(name = "chats")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Chat {

    public enum ChatType { DIRECT, GROUP }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // name e folosit doar pentru grup, daca e 1 - 1 null
    // user vede numele celuilalt user
    @Column(length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ChatType type;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
