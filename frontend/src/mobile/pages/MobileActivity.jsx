import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { Bell, Check, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MobileActivity = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteAll } = useNotification();

    return (
        <div className="pb-24 pt-12">
            <div className="px-6 mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold">Activity</h1>
                    <p className="text-zinc-400 text-sm">
                        {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                    </p>
                </div>
                {notifications.length > 0 && (
                    <div className="flex gap-2">
                        <button
                            onClick={markAllAsRead}
                            className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-800"
                            title="Mark all as read"
                        >
                            <Check size={18} />
                        </button>
                        <button
                            onClick={deleteAll}
                            className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-red-500 border border-zinc-800"
                            title="Clear all"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}
            </div>

            <div className="px-6 flex flex-col gap-4">
                {notifications.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 flex flex-col items-center">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                            <Bell size={24} className="opacity-50" />
                        </div>
                        <p>No new notifications</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div
                            key={notif.id}
                            onClick={() => !notif.isRead && markAsRead(notif.id)}
                            className={`p-4 rounded-2xl border transition-all ${notif.isRead
                                    ? 'bg-transparent border-white/5 text-zinc-400'
                                    : 'bg-zinc-900 border-white/10 text-white shadow-lg'
                                }`}
                        >
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${notif.isRead ? 'bg-transparent' : 'bg-primary'}`} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-sm mb-1">{notif.title}</h4>
                                    <p className="text-sm leading-relaxed opacity-90">{notif.message}</p>
                                    <p className="text-xs text-zinc-600 mt-2">
                                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MobileActivity;
