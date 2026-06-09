package com.chatapp.entity;

public enum MessageDeliveryStatus {
    PENDING,    // mesajul a fost trimis dar nu a fost livrat încă
    DELIVERED,  // mesajul a ajuns la server și a fost livrat lui destinatar
    READ        // destinatarul a văzut mesajul
}
