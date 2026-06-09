package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Mesaj trimis in chat - optimizat pentru scalabilitate
 * - content = text (NULL = mesaj sters)
 * - attachmentUrl = Signed URL la GCS (NULL = fara attachment)
 * - deleted = soft delete flag (mesajele sterse nu se sterge din DB)
 * - updatedAt = timestamp pentru archiving/cleanup policies
 */
@Entity
@Table(
    name = "messages",
    indexes = {
        // Index principal: ce mesaje sa fie afisate in chat
        @Index(name = "idx_messages_chat_not_deleted", columnList = "chat_id, deleted, created_at DESC"),
        // Index pentru cautare dupa sender (pentru analytics, etc)
        @Index(name = "idx_messages_sender_id", columnList = "sender_id"),
        // Index pentru orfan detection (pozele fara mesaj parent)
        @Index(name = "idx_messages_attachment_url", columnList = "attachment_url"),
        // Index pentru cleanup: sterge mesaje vechi
        @Index(name = "idx_messages_created_at", columnList = "created_at"),
        // Index pentru archiving
        @Index(name = "idx_messages_updated_at", columnList = "updated_at")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chat_id", nullable = false)
    private Chat chat;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "attachment_url", columnDefinition = "TEXT")
    private String attachmentUrl;

    @Column(name = "attachment_name")
    private String attachmentName;

    @Column(name = "attachment_type")
    private String attachmentType;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Soft delete flag - mesajul nu e sters fizic din DB, doar marcat ca sters.
     * Beneficii:
     * - Recuperare usoara (undo delete)
     * - Audit trail (cine a sters cand)
     * - Cleanup policies pot actiona pe mesaje vechi sterse
     * - Queries filtrare: WHERE deleted = false
     */
    @Column(name = "deleted", nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    /**
     * Status de livrare a mesajului
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false)
    @Builder.Default
    private MessageDeliveryStatus deliveryStatus = MessageDeliveryStatus.PENDING;

    /**
     * Timestamp când mesajul a fost marcat ca delivered
     */
    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    /**
     * Timestamp când mesajul a fost marcat ca read
     */
    @Column(name = "read_at")
    private LocalDateTime readAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (deliveryStatus == null) deliveryStatus = MessageDeliveryStatus.PENDING;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Soft delete - markeaza mesajul ca sters fara sa-l stearga din DB.
     */
    public void softDelete() {
        this.deleted = true;
        this.content = null;  // Sterge textul mesajului
        this.attachmentUrl = null;  // Sterge referinta la GCS (GCS cleanup policies vor sterge fisierul)
    }

    /**
     * Marchez mesajul ca delivered
     */
    public void markAsDelivered() {
        if (this.deliveryStatus == MessageDeliveryStatus.PENDING) {
            this.deliveryStatus = MessageDeliveryStatus.DELIVERED;
            this.deliveredAt = LocalDateTime.now();
        }
    }

    /**
     * Marchez mesajul ca read
     */
    public void markAsRead() {
        this.deliveryStatus = MessageDeliveryStatus.READ;
        this.readAt = LocalDateTime.now();
        if (this.deliveredAt == null) {
            this.deliveredAt = LocalDateTime.now();
        }
    }
}

