package com.chatapp.repository;

import com.chatapp.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByChatIdOrderByCreatedAtAsc(Long chatId);

    Optional<Message> findFirstByChatIdOrderByCreatedAtDesc(Long chatId);

    // numara mesaje noi: dintr-un chat, trimise dupa o data, de altcineva decat senderul
    long countByChatIdAndCreatedAtAfterAndSenderIdNot(Long chatId, LocalDateTime after, Long senderId);

    // numara TOATE mesajele primite de la altii (cand lastReadAt e null)
    long countByChatIdAndSenderIdNot(Long chatId, Long senderId);
}
