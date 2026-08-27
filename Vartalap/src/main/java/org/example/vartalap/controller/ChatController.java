package org.example.vartalap.controller;

import org.example.vartalap.model.ChatMessage;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;

    public ChatController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/chat/{roomId}/send")
    public void sendMessage(@DestinationVariable String roomId, @Payload ChatMessage message) {
        message.setRoomId(roomId);
        message.setTimestamp(System.currentTimeMillis());
        if (message.getType() == null) {
            message.setType(ChatMessage.MessageType.CHAT);
        }
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }

    @MessageMapping("/chat/{roomId}/join")
    public void join(@DestinationVariable String roomId,
                     @Payload ChatMessage message,
                     SimpMessageHeaderAccessor headerAccessor) {
        if (headerAccessor.getSessionAttributes() != null) {
            headerAccessor.getSessionAttributes().put("username", message.getSender());
            headerAccessor.getSessionAttributes().put("roomId", roomId);
        }
        message.setRoomId(roomId);
        message.setType(ChatMessage.MessageType.JOIN);
        message.setTimestamp(System.currentTimeMillis());
        message.setContent(message.getSender() + " joined the chat");
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }

    @MessageMapping("/chat/{roomId}/typing")
    public void typing(@DestinationVariable String roomId, @Payload ChatMessage message) {
        message.setRoomId(roomId);
        message.setType(ChatMessage.MessageType.TYPING);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }
}

