"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = Chat;
var jsx_runtime_1 = require("react/jsx-runtime");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
function Chat(_a) {
    var messages = _a.messages, isLoading = _a.isLoading, setCurrentPreview = _a.setCurrentPreview;
    (0, react_1.useEffect)(function () {
        var chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }, [JSON.stringify(messages)]);
    return ((0, jsx_runtime_1.jsxs)("div", { id: "chat-container", className: "flex flex-col pb-4 gap-2 overflow-y-auto max-h-full", children: [messages.map(function (message, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col px-4 shadow-sm whitespace-pre-wrap ".concat(message.role !== 'user' ? 'bg-accent dark:bg-white/5 border text-accent-foreground dark:text-muted-foreground py-4 rounded-2xl gap-4 w-full' : 'bg-gradient-to-b from-black/5 to-black/10 dark:from-black/30 dark:to-black/50 py-2 rounded-xl gap-2 w-fit', " font-serif"), children: [message.content.map(function (content, id) {
                        if (content.type === 'text') {
                            return content.text;
                        }
                        if (content.type === 'image') {
                            return ((0, jsx_runtime_1.jsx)("img", { src: content.image, alt: "fragment", className: "mr-2 inline-block w-12 h-12 object-cover rounded-lg bg-white mb-2" }, id));
                        }
                    }), message.object && ((0, jsx_runtime_1.jsxs)("div", { onClick: function () {
                            return setCurrentPreview({
                                fragment: message.object,
                                result: message.result,
                            });
                        }, className: "py-2 pl-2 w-full md:w-max flex items-center border rounded-xl select-none hover:bg-white dark:hover:bg-white/5 hover:cursor-pointer", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.5rem] w-10 h-10 bg-black/5 dark:bg-white/5 self-stretch flex items-center justify-center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Terminal, { strokeWidth: 2, className: "text-[#FF8800]" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "pl-2 pr-4 flex flex-col", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold font-sans text-sm text-primary", children: message.object.title }), (0, jsx_runtime_1.jsx)("span", { className: "font-sans text-sm text-muted-foreground", children: "Click to see fragment" })] })] }))] }, index)); }), isLoading && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1 text-sm text-muted-foreground", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.LoaderIcon, { strokeWidth: 2, className: "animate-spin w-4 h-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Generating..." })] }))] }));
}
//# sourceMappingURL=chat.js.map