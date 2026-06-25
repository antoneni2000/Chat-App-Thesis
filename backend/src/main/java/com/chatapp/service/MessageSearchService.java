package com.chatapp.service;

import com.chatapp.dto.MessageDto;
import com.chatapp.entity.Message;
import com.chatapp.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageSearchService {

    private final MessageRepository messageRepository;
    private final FileStorageService fileStorageService;

    private MessageDto toDtoFreshUrl(com.chatapp.entity.Message m) {
        MessageDto dto = MessageDto.from(m);
        if (dto.attachmentUrl() == null || dto.attachmentUrl().isBlank()) return dto;
        return dto.withAttachmentUrl(fileStorageService.freshUrlFor(dto.attachmentUrl()));
    }

    /**
     * cauta mesaje text intr-un chat specific
     */
    public List<MessageDto> searchInChat(Long chatId, String query) {
        log.info("Searching in chat {} for: {}", chatId, query);
        return messageRepository.searchInChat(chatId, query)
                .stream()
                .map(this::toDtoFreshUrl)
                .toList();
    }

    /**
     * cauta mesaje in TOATE chaturile utilizatorului
     */
    public List<MessageDto> searchInAllMyChats(Long userId, String query) {
        log.info("Searching in all chats for user {} for: {}", userId, query);
        return messageRepository.searchInAllMyChats(userId, query)
                .stream()
                .map(this::toDtoFreshUrl)
                .toList();
    }

    /**
     * marcare mesaj ca citit
     */
    @Transactional
    public MessageDto markMessageAsRead(Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        
        message.markAsRead();
        messageRepository.save(message);
        
        log.info("Marked message {} as read", messageId);
        return MessageDto.from(message);
    }

    /**
     * Marcare mesaj ca livrat
     */
    @Transactional
    public MessageDto markMessageAsDelivered(Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        
        message.markAsDelivered();
        messageRepository.save(message);
        
        log.info("Marked message {} as delivered", messageId);
        return MessageDto.from(message);
    }
}
