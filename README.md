#### 1. 安装
```bash
npm install react-interface-guarder // 类型守卫hook
npm install vite-plugin-interface-to-object // plugin
```
#### 2. vite 插件
```ts
export default defineConfig({
  plugins: [react(), InterfaceGuarderPlugin(), TsInterfaceToExport()],
});
```
#### 3. 使用
```ts
interface Children {
	name: string;
	age: number;
}
interface User {
	name: string;
	age: number;
	sex: "男" | "女";
	Children: Children[];
}
const fetchData = () => {
	const data = Promise.resolve({
		name: "张三",
		age: 18,
	});
	return data;
};
const ShowUser = () => {
	const data = fetchData();
	const user = useInterfaceGuarder<User>(data);
	// user :{name: '张三', age: 18, sex: '女', Children: []}
	return <div>show:{user}</div>
};
export default ShowUser;
```

#### 4. 支持语法
```ts
export type AppUser = {
  name: string | 'default';
  userId: string | 'default';
  loginCount: number | 1;
  primaryProfile: UserProfile;
  publicProfile: {
    displayName: string | number;
    reputationScore: number;
  };
  isEmailVerified: boolean | false;
  displayName: UserAlias;
  hobbies: UserHobby[];
  deprecatedField: null;
  uninitializedField: undefined;
  anyValue: any;
  unknownValue: unknown;
  neverValue?: never | 'neverValue';
};
export type UserProfile = {
  bio: string | undefined;
  age: number | 1;
  emergencyContact: EmergencyContact;
};
export interface EmergencyContact {
  phone: string;
  relatedProfile: UserProfile;
}
export type UserHobby = {
  id: string;
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced';
  startedAt?: string;
  description?: string;
};
export type UserAlias = string | 'default';
```
生成结果：
```ts
{
    "name": "zcy",
    "userId": "default",
    "loginCount": 1,
    "primaryProfile": {
        "age": 1,
        "emergencyContact": {
            "phone": "",
            "relatedProfile": {}
        }
    },
    "publicProfile": {
        "displayName": 0,
        "reputationScore": 0
    },
    "isEmailVerified": false,
    "displayName": "default",
    "hobbies": [],
    "deprecatedField": null,
    "anyValue": null,
    "unknownValue": null
}
```