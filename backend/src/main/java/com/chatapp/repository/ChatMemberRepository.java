package com.chatapp.repository;

import com.chatapp.entity.ChatMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface ChatMemberRepository extends JpaRepository<ChatMember, Long> {

    List<ChatMember> findByChatId(Long chatId);

    boolean existsByChatIdAndUserId(Long chatId, Long userId);

    Optional<ChatMember> findByChatIdAndUserId(Long chatId, Long userId);

    /**
     * toate membership-urile unui user (fara findAll().filter - query directa cu index).
     */
    List<ChatMember> findByUserId(Long userId);

    /**
     * sterge in masa toate apartenentele unui user (folosit la delete account).
     */
    @Modifying
    @Transactional
    int deleteByUserId(Long userId);
}
