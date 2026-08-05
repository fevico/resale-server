import { model, Schema } from "mongoose";
import { Document, ObjectId } from "mongoose";

interface Chat {
  _id: ObjectId;
  sendBy: ObjectId;
  content: string;
  timeStamp: Date;
  viewed: boolean;
}

interface ConversationDocument extends Document {
  participants: ObjectId[];
  participantsIds: string;
  chats: Chat[];
}

const schema = new Schema<ConversationDocument>({
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  participantsIds: {
    type: String,
    unique: true,
    required: true,
  },
  chats: [
    {
      sentBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      timeStamp: {
        type: Date,
        default: Date.now,
      },
      viewed: {
        type: Boolean,
        default: false,
      },
    },
  ],
}, {timestamps: true});

const ConversationModel = model<ConversationDocument>("Conversation", schema);
export default ConversationModel;
