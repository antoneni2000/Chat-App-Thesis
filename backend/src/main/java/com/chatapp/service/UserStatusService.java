package com.chatapp.service;

import com.chatapp.dto.UserStatusDto;
import com.chatapp.entity.User;
import com.chatapp.entity.UserStatus;
import com.chatapp.repository.UserRepository;
import com.chatapp.repository.UserStatusRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserStatusService {

    private final UserStatusRepository statusRepository;
    private final UserRepository userRepository;

    /**
     * Seteaza statusul utilizatorului
     */
    @Transactional
    public UserStatusDto setUserStatus(User user, String statusText, String statusTypeStr) {
        UserStatus status = statusRepository.findByUserId(user.getId())
                .orElse(new UserStatus());

        status.setUser(user);
        status.setStatusText(statusText);

        try {
            UserStatus.StatusType statusType = UserStatus.StatusType.valueOf(statusTypeStr);
            status.setStatusType(statusType);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid status type: {}, using CUSTOM", statusTypeStr);
            status.setStatusType(UserStatus.StatusType.CUSTOM);
        }

        status.setSetAt(LocalDateTime.now());
        status.setUpdatedAt(LocalDateTime.now());

        status = statusRepository.save(status);
        log.info("User {} set status to: {}", user.getId(), statusText);

        return UserStatusDto.from(status);
    }

    /**
     * Obține statusul utilizatorului
     */
    public UserStatusDto getUserStatus(Long userId) {
        return statusRepository.findByUserId(userId)
                .map(UserStatusDto::from)
                .orElse(null);
    }

    /**
     * Reseteaza statusul la ONLINE (când user-ul se deconectează)
     */
    @Transactional
    public void resetStatus(Long userId) {
        statusRepository.findByUserId(userId).ifPresent(status -> {
            status.setStatusType(UserStatus.StatusType.ONLINE);
            status.setStatusText("Online");
            status.setUpdatedAt(LocalDateTime.now());
            statusRepository.save(status);
        });
    }

    /**
     * Creează status default pentru user nou
     */
    @Transactional
    public UserStatus initializeUserStatus(User user) {
        UserStatus status = new UserStatus();
        status.setUser(user);
        status.setStatusType(UserStatus.StatusType.ONLINE);
        status.setStatusText("Online");
        status.setSetAt(LocalDateTime.now());
        status.setUpdatedAt(LocalDateTime.now());
        return statusRepository.save(status);
    }
}
