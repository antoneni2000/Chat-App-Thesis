package com.chatapp.repository;

import com.chatapp.entity.ChatMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatMemberRepository extends JpaRepository<ChatMember, Long> {

    List<ChatMember> findByChatId(Long chatId);

    boolean existsByChatIdAndUserId(Long chatId, Long userId);

    Optional<ChatMember> findByChatIdAndUserId(Long chatId, Long userId);
}
