package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Status al utilizatorului, alegi sau iti pui tu ce vrei
 * Tabela: user_status
 */
@Entity
@Table(name = "user_status")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class UserStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    // status text: poate fi predefinit (In pauza, Medic, Nu deranjati, Intr-o sedinta) sau custom
    @Column(length = 255)
    private String statusText;

    // tip status: ONLINE, AWAY, DND (Do Not Disturb), BUSY, CUSTOM
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private StatusType statusType = StatusType.ONLINE;

    // timestamp când a fost setat statusul
    @Column(name = "set_at", nullable = false)
    private LocalDateTime setAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (setAt == null) setAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum StatusType {
        ONLINE,
        AWAY,
        DND,
        BUSY,
        CUSTOM
    }

    // metoda helper pentru a obține culoarea indicatorului de status
    public String getStatusColor() {
        return switch (statusType) {
            case ONLINE -> "green";
            case AWAY -> "yellow";
            case DND -> "red";
            case BUSY -> "orange";
            case CUSTOM -> "blue";
        };
    }
}
