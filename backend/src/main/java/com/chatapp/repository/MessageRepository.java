package com.chatapp.repository;

import com.chatapp.entity.Message;
import com.chatapp.entity.MessageDeliveryStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByChatIdAndDeletedFalseOrderByCreatedAtAsc(Long chatId);

    Page<Message> findByChatIdAndDeletedFalseOrderByCreatedAtDesc(Long chatId, Pageable pageable);

    Optional<Message> findFirstByChatIdAndDeletedFalseOrderByCreatedAtDesc(Long chatId);

    long countByChatIdAndDeletedFalseAndCreatedAtAfterAndSenderIdNot(Long chatId, LocalDateTime after, Long senderId);

    long countByChatIdAndDeletedFalseAndSenderIdNot(Long chatId, Long senderId);

    List<Message> findByAttachmentUrlAndDeletedFalse(String attachmentUrl);

    @Query("SELECT m FROM Message m WHERE m.deleted = true AND m.updatedAt < :cutoffDate")
    List<Message> findOldDeletedMessages(@Param("cutoffDate") LocalDateTime cutoffDate);

    @Query("SELECT m FROM Message m WHERE m.deleted = false AND m.createdAt < :cutoffDate AND m.updatedAt < :cutoffDate")
    Page<Message> findOldActiveMessages(@Param("cutoffDate") LocalDateTime cutoffDate, Pageable pageable);

    @Modifying
    @Transactional
    @Query("DELETE FROM Message m WHERE m.deleted = true AND m.attachmentUrl IS NULL AND m.updatedAt < :cutoffDate")
    int deleteOldDeletedMessages(@Param("cutoffDate") LocalDateTime cutoffDate);

    @Query("SELECT m FROM Message m WHERE m.chat.id = :chatId AND m.deleted = false " +
           "AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "ORDER BY m.createdAt DESC")
    List<Message> searchInChat(@Param("chatId") Long chatId, @Param("query") String query);

    @Query("SELECT m FROM Message m JOIN ChatMember cm ON cm.chat.id = m.chat.id " +
           "WHERE cm.user.id = :userId AND m.deleted = false " +
           "AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "ORDER BY m.createdAt DESC")
    List<Message> searchInAllMyChats(@Param("userId") Long userId, @Param("query") String query);

    List<Message> findByChatIdAndDeletedFalseAndSenderIdNotAndDeliveryStatusNot(
            Long chatId, Long readerId, MessageDeliveryStatus status);

    @Modifying
    @Transactional
    @Query("UPDATE Message m SET m.deliveryStatus = :readStatus, m.readAt = :now, " +
           "m.deliveredAt = COALESCE(m.deliveredAt, :now), m.updatedAt = :now " +
           "WHERE m.chat.id = :chatId AND m.deleted = false " +
           "AND m.sender.id <> :readerId AND m.deliveryStatus <> :readStatus")
    int bulkMarkAsRead(@Param("chatId") Long chatId,
                       @Param("readerId") Long readerId,
                       @Param("readStatus") MessageDeliveryStatus readStatus,
                       @Param("now") LocalDateTime now);

    @Query("SELECT m FROM Message m WHERE m.chat.id = :chatId AND m.deleted = false " +
           "ORDER BY m.createdAt DESC")
    List<Message> findRecentByChatId(@Param("chatId") Long chatId, Pageable pageable);

    @Query("SELECT m FROM Message m WHERE m.chat.id = :chatId AND m.deleted = false " +
           "AND m.id < :beforeId ORDER BY m.createdAt DESC")
    List<Message> findByChatIdBefore(@Param("chatId") Long chatId,
                                     @Param("beforeId") Long beforeId,
                                     Pageable pageable);

    @Query("SELECT DISTINCT m.attachmentUrl FROM Message m WHERE m.attachmentUrl IS NOT NULL")
    List<String> findAllReferencedAttachments();

    @Query("SELECT COUNT(m) FROM Message m WHERE m.deleted = true")
    long countTombstones();
}
