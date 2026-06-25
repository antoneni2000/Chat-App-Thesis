package com.chatapp.controller;

import com.chatapp.dto.SetStatusRequest;
import com.chatapp.dto.UserDto;
import com.chatapp.dto.UserStatusDto;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.UserStatusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/status")
@RequiredArgsConstructor
@Slf4j
public class UserStatusController {

    private final UserStatusService userStatusService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Seteaza statusul curent al utilizatorului
     */
    @PostMapping("/set")
    @Transactional
    public ResponseEntity<UserStatusDto> setStatus(@RequestBody SetStatusRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        log.info("User {} setting status to: {}", user.getId(), request.statusText());

        UserStatusDto status = userStatusService.setUserStatus(user, request.statusText(), request.statusType());

        // Reincarca user-ul cu statusul updatat ca UserDto.from() sa contina statusul nou
        User fresh = userRepository.findById(user.getId()).orElse(user);
        UserDto userDto = UserDto.from(fresh);

        // Broadcast pe /topic/presence — frontend-ul foloseste deja acest topic pentru a urmari presenta/profilul si statusul utilizatorilor.
        messagingTemplate.convertAndSend("/topic/presence", userDto);

        return ResponseEntity.ok(status);
    }

    /**
     * Obtine status utilizator curent
     */
    @GetMapping("/me")
    public ResponseEntity<UserStatusDto> getMyStatus() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        UserStatusDto status = userStatusService.getUserStatus(user.getId());
        return ResponseEntity.ok(status);
    }

    /**
     * Obține statusul unui utilizator specific
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserStatusDto> getUserStatus(@PathVariable Long userId) {
        UserStatusDto status = userStatusService.getUserStatus(userId);
        return ResponseEntity.ok(status);
    }
}
