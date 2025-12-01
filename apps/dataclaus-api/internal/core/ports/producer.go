package ports

import "context"

// EventProducer defines the interface for publishing events to a message queue.
type EventProducer interface {
	Publish(ctx context.Context, topic string, key []byte, value []byte) error
	Close() error
}
