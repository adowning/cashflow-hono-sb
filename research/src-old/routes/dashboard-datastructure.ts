
interface DashboardConsoleData
{
    // Timestamp for data refresh
    lastUpdated: string

    // CardList Component Data (Stats Cards)
    statsCards: {
        items: {
            des: string          // Card description ("Total number of visits")
            icon: string         // Icon character code ("")
            startVal: number     // Animation starting value (0)
            duration: number     // Animation duration in ms (1000)
            num: number          // Target number to display (9120)
            change: string       // Percentage change (+20%, -12%)
        }[]
    }

    // ActiveUser Component Data (Bar Chart + Stats)
    activeUsers: {
        chartData: number[]           // [160, 100, 150, 80, 190, 100, 175, 120, 160]
        xAxisData: string[]           // ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
        stats: {
            name: string    // "总用户量", "总访问量", "日访问量", "周同比"
            num: string     // "32k", "128k", "1.2k", "+5%"
        }[]
    }

    // SalesOverview Component Data (Line Chart)
    salesOverview: {
        data: number[]                // [50, 25, 40, 20, 70, 35, 65, 30, 35, 20, 40, 44]
        xAxisData: string[]           // ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
        growth: string                // "+15%"
        title: string                 // "访问量"
    }

    // NewUser Component Data (User Table with Progress)
    newUsers: {
        selectedPeriod: string        // "This month", "Last month", "This year"
        tableData: {
            username: string    // "中小鱼", "何小荷", "誶誶淰", etc.
            province: string    // "北京", "深圳", "上海", etc.
            sex: number         // 1 = male, 0 = female
            age: number         // User age (22, 21, 23, etc.)
            percentage: number  // Progress percentage (60, 20, 60, etc.)
            pro: number         // Animated progress value (same as percentage)
            color: string       // Progress bar color ("rgb(var(--art-primary)) !important")
            avatar: string      // Avatar image path
        }[]
    }

    // RecentTransaction Component Data (Timeline)
    recentTransactions: {
        timelineData: {
            time: string     // "09:30am", "10:00 am", "12:00 am", etc.
            status: string   // Status color ("rgb(73, 190, 255)")
            content: string  // "Receive order #38291 and pay ¥385.90"
            code?: string    // Optional reference code ("SKU-3467", "PROMO-2023")
        }[]
        title: string      // "Recent Transactions"
        subtitle: string   // "Today's Order Updates"
    }

    // Dynamic Component Data (User Activities)
    dynamicActivities: {
        list: {
            username: string   // "中小鱼", "何小荷", "誶誶淰", etc.
            type: string       // "关注了", "发表文章", "提出问题", "兑换了物品", "关闭了问题"
            target: string     // Target user/content ("誶誶淰", "Vue3 + Typescript + Vite 项目实战笔记")
        }[]
        newCount: number     // "+6"
        title: string        // "动态"
    }

    // TodoList Component Data (Task Management)
    todoList: {
        list: {
            username: string   // Task description ("查看今天工作内容", "回复邮件")
            date: string       // Scheduled time ("上午 09:30", "上午 10:30")
            complete: boolean  // Completion status (true/false)
        }[]
        pendingCount: number // "3"
        title: string        // "代办事项"
    }

    // AboutProject Component Data (Static Info)
    projectInfo: {
        systemName: string     // From AppConfig.systemInfo.name
        description: string[]  // [
        //   "系统名是一款专注于用户体验和视觉设计的后台管理系统模版",
        //   "使用了 Vue3、TypeScript、Vite、Element Plus 等前沿技术"
        // ]
        buttons: {
            text: string    // "项目官网", "文档", "Github", "博客"
            url: string     // From WEB_LINKS constants
        }[]
    }
}

// Example of how this data structure would look when populated:


const exampleDashboardData: DashboardConsoleData = {
    lastUpdated: "2025-10-30T13:23:02.687Z",

    statsCards: {
        items: [
            {
                des: "Total number of visits",
                icon: "",
                startVal: 0,
                duration: 1000,
                num: 9120,
                change: "+20%"
            },
            {
                des: "Number of online visitors",
                icon: "",
                startVal: 0,
                duration: 1000,
                num: 182,
                change: "+10%"
            },
            {
                des: "click volume",
                icon: "",
                startVal: 0,
                duration: 1000,
                num: 9520,
                change: "-12%"
            },
            {
                des: "new user",
                icon: "",
                startVal: 0,
                duration: 1000,
                num: 156,
                change: "+30%"
            }
        ]
    },

    activeUsers: {
        chartData: [160, 100, 150, 80, 190, 100, 175, 120, 160],
        xAxisData: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        stats: [
            { name: "总用户量", num: "32k" },
            { name: "总访问量", num: "128k" },
            { name: "日访问量", num: "1.2k" },
            { name: "周同比", num: "+5%" }
        ]
    },

    salesOverview: {
        data: [50, 25, 40, 20, 70, 35, 65, 30, 35, 20, 40, 44],
        xAxisData: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
        growth: "+15%",
        title: "访问量"
    },

    newUsers: {
        selectedPeriod: "This month",
        tableData: [
            {
                username: "中小鱼",
                province: "北京",
                sex: 0,
                age: 22,
                percentage: 60,
                pro: 0,
                color: "rgb(var(--art-primary)) !important",
                avatar: "@/assets/img/avatar/avatar1.webp"
            },
            // ... more users
        ]
    },

    recentTransactions: {
        timelineData: [
            {
                time: "09:30am",
                status: "rgb(73, 190, 255)",
                content: "Receive order #38291 and pay ¥385.90"
            },
            {
                time: "10:00 am",
                status: "rgb(54, 158, 255)",
                content: "New product on shelves",
                code: "SKU-3467"
            },
            // ... more transactions
        ],
        title: "Recent Transactions",
        subtitle: "Today's Order Updates"
    },

    dynamicActivities: {
        list: [
            {
                username: "中小鱼",
                type: "关注了",
                target: "誶誶淰"
            },
            {
                username: "何小荷",
                type: "发表文章",
                target: "Vue3 + Typescript + Vite 项目实战笔记"
            },
            // ... more activities
        ],
        newCount: 6,
        title: "动态"
    },

    todoList: {
        list: [
            {
                username: "查看今天工作内容",
                date: "上午 09:30",
                complete: true
            },
            {
                username: "产品需求会议",
                date: "下午 02:00",
                complete: false
            },
            // ... more todos
        ],
        pendingCount: 3,
        title: "代办事项"
    },

    projectInfo: {
        systemName: "System Name",
        description: [
            "系统名是一款专注于用户体验和视觉设计的后台管理系统模版",
            "使用了 Vue3、TypeScript、Vite、Element Plus 等前沿技术"
        ],
        buttons: [
            { text: "项目官网", url: "https://example.com" },
            { text: "文档", url: "https://docs.example.com" },
            { text: "Github", url: "https://github.com/example" },
            { text: "博客", url: "https://blog.example.com" }
        ]
    }
}
