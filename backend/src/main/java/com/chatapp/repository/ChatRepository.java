package com.chatapp.repository;

import com.chatapp.entity.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository<Chat, Long> {

    // toate chaturile in care e membru un user, exceptand cele cu deletedAt setat
    @Query("""
        SELECT cm.chat FROM ChatMember cm
        WHERE cm.user.id = :userId
          AND cm.deletedAt IS NULL
        ORDER BY cm.chat.createdAt DESC
    """)
    List<Chat> findVisibleChatsForUser(@Param("userId") Long userId);

    // cauta chat DIRECT intre 2 utilizatori, indiferent de starea de delete
    @Query("""
        SELECT cm1.chat FROM ChatMember cm1
        JOIN ChatMember cm2 ON cm1.chat.id = cm2.chat.id
        WHERE cm1.chat.type = com.chatapp.entity.Chat.ChatType.DIRECT
          AND cm1.user.id = :userId1
          AND cm2.user.id = :userId2
    """)
    Optional<Chat> findDirectChatBetween(@Param("userId1") Long userId1,
                                         @Param("userId2") Long userId2);
}
