package com.chatapp.repository;

import com.chatapp.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    // toate mesajele dintr-un chat
    // ordine cronologica, cel mai vechi primul, cel mai nou ultimul
    List<Message> findByChatIdOrderByCreatedAtAsc(Long chatId);
}
