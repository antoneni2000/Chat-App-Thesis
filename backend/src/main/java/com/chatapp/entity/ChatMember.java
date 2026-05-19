package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Many-to-many intre user si chat.
 * - deletedAt: soft-delete pentru un user
 * - lastReadAt: cand a citit ultima oara user-ul aceasta conversatie
 */
@Entity
@Table(
    name = "chat_members",
    uniqueConstraints = @UniqueConstraint(columnNames = {"chat_id", "user_id"})
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ChatMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chat_id", nullable = false)
    private Chat chat;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;

    @PrePersist
    void onCreate() {
        if (joinedAt == null) joinedAt = LocalDateTime.now();
    }
}
