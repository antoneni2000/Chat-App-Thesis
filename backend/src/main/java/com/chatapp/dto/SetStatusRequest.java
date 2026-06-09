package com.chatapp.dto;

public record SetStatusRequest(
    String statusText,
    String statusType  // ONLINE, AWAY, DND, BUSY, CUSTOM
) {}
