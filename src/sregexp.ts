// // /**
// //  * A library for supporting user-facings regular expressions.
// //  * * validates regular expression grammers
// //  * * compiles to RegExp
// //  * 
// //  * Grammar:
// //  * C::= a-z | A-Z | 0-9 | ...                Character sets
// //  * C::= . | \d | \D | \w | \W | \s | \S | \t | \r | \n | \v | \f | \0 | \cX | \xhh | \uhhhh | \u{hhhh} | \{hhhhh} 
// //  * B::= ^ | $ | \b | \B                      Boundaries
// //  * Q::= E* | E+ | E? | E{n} | E{n,} | E{n,m} Quantifiers
// //  * E::= C
// //  *      B
// //  *      (E)
// //  *      (?<id>E)
// //  *      (?:E)
// //  *      \n                                   Back reference
// //  *      E|E                                  union
// //  *      EE                                   concatination
// //  *      Q
// //  *      Q?
// //  *      E(?=E)                               Only if folowwed by ...
// //  *      E(?!E)                               If not followed by ...
// //  */

// type identity = number | string;

// class Context {
//   constructor(public currentScope: string, public ids: identity[]) { }
//   public allocId(id: string) : Context {
//     if(/[.]/.test(id))
//       throw new RegExpError(`invalid identity name: ${id}`);    
//     if(this.ids.some((id2) => (id2==id)))
//       throw new RegExpError(`duplicate identity: ${id}`);
//     return new Context('', this.ids.concat(id));
//   }
//   public static makeFresh() : Context {
//     return new Context('', []);
//   }
//   public getNextIndex() {
//     return this.ids.length;
//   }
//   public scope(scope: string) : Context {
//     if(/[.]/.test(scope))
//       throw new RegExpError(`invalid scope name: ${scope}`);    
//     return new Context(this.scope + '.' + scope, this.ids);
//   }
//   public concat(ctx: Context) {
//     ctx.ids.forEach((id1) => {
//       if(this.ids.some((id2) => (id1==id2)))
//         throw new RegExpError(`duplicate identity: ${id1}`);
//     });
//     return new Context(ctx.currentScope, this.ids.concat(ctx.ids));
//   }
//   public addIds(ids: identity[]) {
//     ids.forEach((id1) => {
//       if(typeof id1 == 'string' && !/[a-zA-Z]\w*/.test(<string>id1))
//         throw new RegExpError(`invalid identity name: ${id1}`);
//       if(this.ids.some((id2) => (id1==id2)))
//         throw new RegExpError(`duplicate identity: ${id1}`);
//     });
//     return new Context(this.currentScope, this.ids.concat(ids));
//   }
//   public allocFreshId() {
//     return {id: this.ids.length, newContext: new Context(this.currentScope, this.ids.concat(null))};
//   }
//   public lookupBackreference(id: identity) {
//     const idx = this.ids.indexOf(id);
//     if(idx < 0)
//       throw new RegExpError(`backreference to ${id} is undefined`);
//     else
//       return 1+idx;
//   }
// }

// export class RegularExpression<T> {
//   private regexp : RegExp;
//   interp: (registers: string[]) => T;
//   constructor(re : string, interp: (registers: string[]) => T) {
//     this.regexp = new RegExp(re);
//     this.interp = interp;
//   };
//   public get source(): string {
//     return this.regexp.source;
//   }
//   public exec(str: string) : T {
//     const results = this.regexp.exec(str);
//     return this.interp(results);
//   }
// }


// class CompiledRE<T> {
//   regexp: RegularExpression<T>;
//   grouped: boolean;
//   newContext: Context;
//   ids: identity[]; // the identities provided by this expression
//   constructor(x: {regexp: RegularExpression<T>, grouped: boolean, newContext: Context, ids: identity[]}) {
//     this.regexp=x.regexp;
//     this.grouped=x.grouped;
//     this.newContext=x.newContext;
//     this.ids = x.ids;
//   }
//   public with(x: {regexp?: RegularExpression<T>, grouped?: boolean, newContext?: Context, ids?: identity[]}) : CompiledRE<T> {
//     return new CompiledRE({regexp: x.regexp || this.regexp, grouped: x.grouped!==undefined ? x.grouped : this.grouped, newContext: x.newContext || this.newContext, ids: x.ids || this.ids});
//   }
//   public withRegexp<X>(x: {regexp: RegularExpression<X>, grouped?: boolean, newContext?: Context, ids?: identity[]}) : CompiledRE<X> {
//     return new CompiledRE({regexp: x.regexp, grouped: x.grouped!==undefined ? x.grouped : this.grouped, newContext: x.newContext || this.newContext, ids: x.ids || this.ids});
//   }
// }

// class RegExpError {
//   constructor(public message: string) {}
// }

// export abstract class RegularExpressionAST<T> {  
//   abstract compileAST(context: Context) : CompiledRE<T>;
//   abstract getIds() : identity[];
//   public compile() : RegularExpression<T> {
//     const cexp = this.compileAST(Context.makeFresh());
//     return cexp.regexp;
//   }
// }

// function groupedRE<T>(re: CompiledRE<T>) : RegularExpression<T> {
//   if(re.grouped)
//     return re.regexp;
//   else
//     return new RegularExpression<T>(`(?:${re.regexp.source})`, re.regexp.interp);
// }

// function makeGrouped<T>(re: CompiledRE<T>) : CompiledRE<T> {
//   if(re.grouped)
//     return re;
//   else
//     return re.with({
//       regexp: new RegularExpression<T>(`(?:${re.regexp.source})`, re.regexp.interp),
//       grouped: true
//     });
// }

// // export class Union3<X, T extends Array<X>> extends RegularExpressionAST<{index: number, value: T}> {
// //   constructor(private expressions : RegularExpressionAST<T>[] = []) {super()}

// //   compileAST(context: Context) : CompiledRE<{index: number, value: T}> {
// //     const compiledExprs : CompiledRE<T>[] = this.expressions.map((cexpr) => cexpr.compileAST(context));
// //     const interp = (registers: string[]) : {index: number, value: T} => {
// //         for(let idx = 0; idx < compiledExprs.length; ++idx) {
// //           const results = compiledExprs[idx].regexp.interp(registers);
// //           if(results)
// //             return {index: idx, value: results};
// //         }
// //         return undefined;
// //       };
// //     const scopedIds = compiledExprs.reduce((ids: identity[], e, idx) => ids.concat(e.ids),[]);
// //     return new CompiledRE({
// //       regexp: new RegularExpression<{index: number, value: T}>(compiledExprs.map((e) => groupedRE(e)).join('|'), interp),
// //       grouped: false,
// //       newContext: context.addIds(scopedIds),
// //       ids: scopedIds
// //       });
// //   }
// //   getIds() : identity[] {
// //     return this.expressions.reduce((ids, e) => ids.concat(e.getIds()), []);
// //   }
// // }

// // const z = new Union3<number|string,[number,string]>();
// // let a = z.compileAST()

// export class Union<T> extends RegularExpressionAST<{index: number, value: T}> {
//   constructor(private expressions : RegularExpressionAST<T>[] = []) {super()}

//   compileAST(context: Context) : CompiledRE<{index: number, value: T}> {
//     const compiledExprs : CompiledRE<T>[] = this.expressions.map((cexpr) => cexpr.compileAST(context));
//     const interp = (registers: string[]) : {index: number, value: T} => {
//         for(let idx = 0; idx < compiledExprs.length; ++idx) {
//           const results = compiledExprs[idx].regexp.interp(registers);
//           if(results)
//             return {index: idx, value: results};
//         }
//         return undefined;
//       };
//     const scopedIds = compiledExprs.reduce((ids: identity[], e, idx) => ids.concat(e.ids),[]);
//     return new CompiledRE({
//       regexp: new RegularExpression<{index: number, value: T}>(compiledExprs.map((e) => groupedRE(e)).join('|'), interp),
//       grouped: false,
//       newContext: context.addIds(scopedIds),
//       ids: scopedIds
//       });
//   }
//   getIds() : identity[] {
//     return this.expressions.reduce((ids, e) => ids.concat(e.getIds()), []);
//   }
// }


// // export class Union2<T1,T2> extends RegularExpressionAST<{tag: I1, value: T1}|{tag: I2, value: T2}> {
// //   constructor(private tag1: I1, private expr1 : RegularExpressionAST<T1>, private tag2: I2, private expr2: RegularExpressionAST<T2>) {super()}
// //   compileAST(context: Context) : CompiledRE<{tag: I1, value: T1}|{tag: I2, value: T2}> {
// //     const cexpr1 = this.expr1.compileAST(context);
// //     const cexpr2 = this.expr2.compileAST(context);
// //     const interp = (registers: string[]) : {tag: I1, value: T1}|{tag: I2, value: T2} => {
// //         const results1 = cexpr1.regexp.interp(registers);
// //         if(results1)
// //           return {tag: this.tag1, value: results1};
// //         else
// //           return {tag: this.tag2, value: cexpr2.regexp.interp(registers) };
// //       };
// //     return new CompiledRE({
// //       regexp: new RegularExpression(groupedRE(cexpr1).source + '|' + groupedRE(cexpr2).source, interp),
// //       grouped: false,
// //       newContext: context.addIds(cexpr1.ids.concat(cexpr2.ids)),
// //       ids: cexpr1.ids.concat(cexpr2.ids),
// //       });
// //   }
// //   getIds() : identity[] {
// //     return this.expr1.getIds().concat(this.expr2.getIds());
// //   }
// // }

// // interface UnionTag<T,V> { tag: T, value: V}

// // export class Union<T1,V1,T2,V2,X1 extends UnionTag<T1,V1>, X2 extends UnionTag<T2,V2>> extends RegularExpressionAST<X1|X2> {
// //   constructor(private exprHd : RegularExpressionAST<Thd>, private exprTl: RegularExpressionAST<Array<Ttl>>) {super()}
// //   compileAST(context: Context) : CompiledRE<{0: Thd} & Array<Thd|Ttl>> {
// //     const cexpr1 = this.expr1.compileAST(context);
// //     const cexpr2 = this.expr2.compileAST(context);
// //     const interp = (registers: string[]) : {tag: I1, value: T1}|{tag: I2, value: T2} => {
// //         const results1 = cexpr1.regexp.interp(registers);
// //         if(results1)
// //           return {tag: this.tag1, value: results1};
// //         else
// //           return {tag: this.tag2, value: cexpr2.regexp.interp(registers) };
// //       };
// //     return new CompiledRE({
// //       regexp: new RegularExpression(groupedRE(cexpr1).source + '|' + groupedRE(cexpr2).source, interp),
// //       grouped: false,
// //       newContext: context.addIds(cexpr1.ids.concat(cexpr2.ids)),
// //       ids: cexpr1.ids.concat(cexpr2.ids),
// //       });
// //   }
// //   getIds() : identity[] {
// //     return this.expr1.getIds().concat(this.expr2.getIds());
// //   }
// // }


// // export class Union<Thd,Ttl> extends RegularExpressionAST<{0: Thd} & Array<Thd|Ttl>> {
// //   constructor(private exprHd : RegularExpressionAST<Thd>, private exprTl: RegularExpressionAST<Array<Ttl>>) {super()}
// //   compileAST(context: Context) : CompiledRE<{0: Thd} & Array<Thd|Ttl>> {
// //     const cexpr1 = this.expr1.compileAST(context);
// //     const cexpr2 = this.expr2.compileAST(context);
// //     const interp = (registers: string[]) : {tag: I1, value: T1}|{tag: I2, value: T2} => {
// //         const results1 = cexpr1.regexp.interp(registers);
// //         if(results1)
// //           return {tag: this.tag1, value: results1};
// //         else
// //           return {tag: this.tag2, value: cexpr2.regexp.interp(registers) };
// //       };
// //     return new CompiledRE({
// //       regexp: new RegularExpression(groupedRE(cexpr1).source + '|' + groupedRE(cexpr2).source, interp),
// //       grouped: false,
// //       newContext: context.addIds(cexpr1.ids.concat(cexpr2.ids)),
// //       ids: cexpr1.ids.concat(cexpr2.ids),
// //       });
// //   }
// //   getIds() : identity[] {
// //     return this.expr1.getIds().concat(this.expr2.getIds());
// //   }
// // }

// export class ScopedUnion<T> extends RegularExpressionAST<{index: number, value: T}> {
//   constructor(private expressions : RegularExpressionAST<T>[]) {super()}
//   compileAST(context: Context) : CompiledRE<{index: number, value: T}> {
//     const compiledExprs : CompiledRE<T>[] = []
//     for(let idx = 0; idx < this.expressions.length; ++idx) {
//       const cexpr = this.expressions[idx].compileAST(context.scope(idx.toString()));
//       compiledExprs.push(cexpr);
//     }
//     const interp = (registers: string[]) : {index: number, value: T} => {
//         for(let idx = 0; idx < compiledExprs.length; ++idx) {
//           const results = compiledExprs[idx].regexp.interp(registers);
//           if(results)
//             return {index: idx, value: results};
//         }
//         return undefined;
//       };
//     const scopedIds = compiledExprs.reduce((ids: identity[], e, idx) => ids.concat(e.ids),[]);
//     return new CompiledRE({
//       regexp: new RegularExpression<{index: number, value: T}>(compiledExprs.map((e) => groupedRE(e)).join('|'), interp),
//       grouped: false,
//       newContext: context.addIds(scopedIds),
//       ids: scopedIds
//       });
//   }
//   getIds() : identity[] {
//     return this.expressions.reduce((ids, e) => ids.concat(e.getIds()), []);
//   }
// }

// export class Concatenation<X, T extends Array<X>> extends RegularExpressionAST<T> {
//   constructor(private exprs : RegularExpressionAST<X>[], private t: T) {super()}
//   compileAST(context: Context) : CompiledRE<T>{
//     const cexprs : CompiledRE<X>[] = [];
//     let ctx = context;
//     for(const expr of this.exprs) {
//       const cexpr = expr.compileAST(ctx);
//       cexprs.push(cexpr);
//       ctx = cexpr.newContext;
//     }
//     const interp = (registers: string[]) : T => {
//         const results : T = this.t;
//         for(let idx = 0; idx < cexprs.length; ++idx)
//           results[idx] = cexprs[idx].regexp.interp(registers);
//         return results;
//       };
//     return new CompiledRE({
//       regexp: new RegularExpression(cexprs.map((e) => e.regexp.source).join(''), interp),
//       grouped: false,
//       newContext: ctx,
//       ids: cexprs.reduce((ids,e) => ids.concat(e.ids), []),
//       });
//   }
//   getIds() : identity[] {
//     return this.exprs.reduce((ids,e) => ids.concat(e.getIds()), []);
//   }
// }

// type T = [number,string,number];
// const a : T = [1,'foo',3];
// const b : (RegularExpressionAST<number|string>)[] = [null,null,null];
// const c = new Concatenation<number|string,T>(b, a);
// const x = c.compile();
// const z = x.exec('sss');
// const y= z[0];


// // export class Concatenation<T1,T2> extends RegularExpressionAST<T1&T2> {
// //   constructor(private expr1 : RegularExpressionAST<T1>, private expr2 : RegularExpressionAST<T2>) {super()}
// //   compileAST(context: Context) : CompiledRE<T1&T2>{
// //     const cexpr1 = this.expr1.compileAST(context);
// //     const cexpr2 = this.expr2.compileAST(cexpr1.newContext);
// //     const interp = (registers: string[]) : T1&T2 => {
// //         const results1 = cexpr1.regexp.interp(registers);
// //         const results2 = cexpr2.regexp.interp(registers);
// //         return Object.assign(results1, results2);
// //       };
// //     return new CompiledRE({
// //       regexp: new RegularExpression(groupedRE(cexpr1).source + '|' + groupedRE(cexpr2).source, interp),
// //       grouped: false,
// //       newContext: cexpr2.newContext,
// //       ids: cexpr1.ids.concat(cexpr2.ids),
// //       });
// //   }
// //   getIds() : identity[] {
// //     return this.expr1.getIds().concat(this.expr2.getIds());
// //   }
// // }

//     let ctx = context;
//     const compiledExprs : CompiledRE[] = []
//     for(const expr of this.expressions) {
//       const cexpr = expr.compile(ctx);
//       ctx = cexpr.newContext;
//       compiledExprs.push(cexpr);
//     }
//     return new CompiledRE({
//       regexp: compiledExprs.map((e) => groupedRE(e)).join(''),
//       grouped: false,
//       newContext: ctx,
//       ids: compiledExprs.reduce((i,e) => i.concat(e.ids),[])
//       });
//   }
//   getIds() : identity[] {
//     return this.expressions.reduce((ids, e) => ids.concat(e.getIds()), []);
//   }
// }

// export class Quantifier extends RegularExpressionAST {
//   constructor(private expression : RegularExpressionAST,
//               private parameters : {minimum?: number, maximum?: number, greedy: boolean}) {
//     super();
//   }
//   private compileGreedy() {
//     return (this.parameters.greedy === undefined || this.parameters.greedy === true) ? '' : '?'
//   }
//   private compileQuantifier() {
//     return `{${this.parameters.minimum || ''},${this.parameters.maximum || ''}`;
//   }
//   compile(context: Context) : CompiledRE {
//     const cexpr = this.expression.compile(context);
//     return new CompiledRE({
//       regexp: `${groupedRE(cexpr)}${this.compileQuantifier()}${this.compileGreedy()}}`,
//       grouped: false,
//       newContext: cexpr.newContext,
//       ids: cexpr.ids
//     });
//   }
//   getIds() : identity[] {
//     return this.expression.getIds();
//   }
// }

// export class NoncapturingGroup extends RegularExpressionAST {
//   constructor(private expression : RegularExpressionAST) {
//     super();
//   }
//   compile(context: Context) : CompiledRE {
//     return this.expression.compile(context);
//   }
//   getIds() : identity[] {
//     return this.expression.getIds();
//   }
// }

// export class NamedCapturingGroup extends RegularExpressionAST {
//   constructor(
//       private expression : RegularExpressionAST,
//       private id: string) {
//     super();
//   }
//   compile(context: Context) : CompiledRE {
//     const ctx = context.allocId(this.id);
//     const cexpr = this.expression.compile(ctx);
//     return new CompiledRE({
//       regexp: `(${cexpr.regexp})`,
//       grouped: true,
//       newContext: cexpr.newContext,
//       ids: cexpr.ids.concat(this.id)
//     });
//   }
//   getIds() : identity[] {
//     return this.expression.getIds().concat(this.id);
//   }
// }


// export class Backreference extends RegularExpressionAST {
//   constructor(
//       private id: identity) {
//     super();
//   }
//   compile(context: Context) : CompiledRE {
//     return new CompiledRE({
//       regexp: `\\${context.lookupBackreference(this.id)}`,
//       grouped: true,
//       newContext: context,
//       ids: []
//     });
//   }
//   getIds() : identity[] {
//     return [];
//   }
// }
