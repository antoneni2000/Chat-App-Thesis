package com.chatapp.repository;

import com.chatapp.entity.ChatMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMemberRepository extends JpaRepository<ChatMember, Long> {

    List<ChatMember> findByChatId(Long chatId);

    boolean existsByChatIdAndUserId(Long chatId, Long userId);
}
