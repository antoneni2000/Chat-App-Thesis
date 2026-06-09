package com.chatapp.dto;

import com.chatapp.entity.UserStatus;

public record UserStatusDto(
    Long id,
    String statusText,
    String statusType,
    String statusColor
) {
    public static UserStatusDto from(UserStatus status) {
        if (status == null) return null;
        return new UserStatusDto(
            status.getId(),
            status.getStatusText(),
            status.getStatusType().toString(),
            status.getStatusColor()
        );
    }
}
