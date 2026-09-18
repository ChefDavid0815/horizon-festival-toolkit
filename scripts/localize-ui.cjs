// One-time source migration. Runtime translation lives in src/i18n.mjs.
const fs=require('node:fs');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const generate=require('@babel/generator').default;
const t=require('@babel/types');
const source=fs.readFileSync('src/App.jsx','utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const chinese=s=>/[\u3400-\u9fff]/.test(s);
const call=s=>t.callExpression(t.identifier('t'),[t.stringLiteral(s)]);
traverse(ast,{
 JSXText(p){const text=p.node.value.trim().replace(/\s+/g,' ');if(chinese(text)&&text!=='简体中文')p.replaceWith(t.jsxExpressionContainer(call(text)));},
 StringLiteral(p){if(!chinese(p.node.value)||p.node.value==='Language / 语言')return;
  if(p.parentPath.isCallExpression()&&p.parent.callee.name==='t')return;
  if(p.parentPath.isJSXAttribute()){p.replaceWith(t.jsxExpressionContainer(call(p.node.value)));p.skip();return;}
  if(p.findParent(x=>x.isJSXExpressionContainer())){p.replaceWith(call(p.node.value));p.skip();}
 },
 TemplateLiteral(p){if(!p.findParent(x=>x.isJSXAttribute()||x.isJSXExpressionContainer()))return;
  const key=p.node.quasis.map((q,i)=>q.value.cooked+(i<p.node.expressions.length?'{'+i+'}':'')).join('');
  if(chinese(key)){p.replaceWith(t.callExpression(t.identifier('t'),[t.stringLiteral(key),t.arrayExpression(p.node.expressions)]));p.skip();}
 }
});
fs.writeFileSync('src/App.jsx',generate(ast).code+'\n');
