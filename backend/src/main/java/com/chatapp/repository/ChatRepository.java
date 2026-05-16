package com.chatapp.repository;

import com.chatapp.entity.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository<Chat, Long> {

    // toate chaturile in care e membru un anumit user
    // oridne descrescatoare, de la cel mai recent la cel mai vechi
    @Query("""
        SELECT cm.chat FROM ChatMember cm
        WHERE cm.user.id = :userId
        ORDER BY cm.chat.createdAt DESC
    """)
    List<Chat> findAllByUserId(@Param("userId") Long userId);

    // cauta chat direct intre 2 utilizatori daca exista
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
