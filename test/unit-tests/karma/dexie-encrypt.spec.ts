import faker from 'faker';
import { Encryption } from '../../../src/encryption.class';
import * as hooks from '../../../src/hooks';
import * as immutable from '../../../src/immutable';
import { databasesNegative, databasesPositive, Friend, mockFriends, TestDatabaseNotImmutable } from '../../mocks/mocks';

describe('Encrypted databases', () => {
    // Should work for each positive database
    databasesPositive.forEach(database => {
        describe(database.desc, () => {
            let db: ReturnType<typeof database.db>;
            beforeEach(async () => {
                spyOn(immutable, 'immutable').and.callThrough();
                db = database.db();
                await db.open();
                expect(db.isOpen()).toBeTrue();
            });
            afterEach(async () => {
                await db.delete();
            });
            it('should override create methods', async () => {
                const [friend] = mockFriends(1);
                await db.friends.add(friend);
                expect(immutable.immutable).toHaveBeenCalled();
            });
            describe('Hooks', () => {
                let friends: Friend[];
                let id: string;
                let ids: string[];
                beforeEach(async () => {
                    friends = mockFriends();
                    id = await db.friends.bulkAdd(friends);
                    ids = friends.map(friend => Encryption.hash(friend));
                    const hooksSpy = spyOnAllFunctions(hooks);
                    Object.keys(hooksSpy).forEach(key => hooksSpy[key].and.callThrough());
                });
                describe('Creation', () => {
                    let newFriends: Friend[];
                    beforeEach(async () => {
                        newFriends = mockFriends();
                    });
                    afterEach(() => {
                        expect(hooks.encryptOnCreation).toHaveBeenCalled();
                        expect(hooks.encryptOnUpdating).not.toHaveBeenCalled();
                        expect(hooks.decryptOnReading).not.toHaveBeenCalled();
                    });
                    it('should be called on add()', async () => {
                        await db.friends.add(newFriends[0]);
                    });
                    it('should be called on bulkAdd()', async () => {
                        await db.friends.bulkAdd(newFriends);
                    });
                    it('should be called on put()', async () => {
                        await db.friends.put(newFriends[0]);
                    });
                    it('should be called on bulkPut()', async () => {
                        await db.friends.bulkPut(newFriends);
                    });
                });
                describe('Updating', () => {
                    afterEach(() => {
                        expect(hooks.encryptOnUpdating).toHaveBeenCalled();
                        expect(hooks.encryptOnCreation).not.toHaveBeenCalled();
                        expect(hooks.decryptOnReading).not.toHaveBeenCalled();
                    });
                    it('should be called on update()', async () => {
                        await db.friends.update(id, friends[1]);
                    });
                    it('should be called on put()', async () => {
                        await db.friends.put({ ...friends[1], id });
                    });
                    it('should be called on bulkPut()', async () => {
                        /*
                        * For v3 of Dezie
                        */
                        // const getFriends = await db.friends.bulkGet(hashedIds);
                        const friends2 = mockFriends();
                        const hashedDocuments = friends2.map((friend, i) => ({ ...friend, id: ids[i] }));
                        await db.friends.bulkPut(hashedDocuments);
                    });
                });
                describe('Reading', () => {
                    afterEach(() => {
                        expect(hooks.decryptOnReading).toHaveBeenCalled();
                        expect(hooks.encryptOnUpdating).not.toHaveBeenCalled();
                        expect(hooks.encryptOnCreation).not.toHaveBeenCalled();
                    });
                    it('should be called on get()', async () => {
                        await db.friends.get(id);
                    });
                    it('should be called on where()', async () => {
                        await db.friends.where('age')
                            .between(1, 80, true, true)
                            .first();
                    });
                });
            });
            describe('Id generation', () => {
                describe('Add()', () => {
                    it('should generate hashed id if not provided', async () => {
                        const [friend] = mockFriends(1);
                        const id = await db.friends.add(friend);

                        const expectedId = Encryption.hash(friend);
                        expect(id).toBe(expectedId);
                    });
                    it('should keep provided id when an id is provided', async () => {
                        const [friend] = mockFriends(1);
                        const fakeId = 'mock-id: ' + faker.random.alphaNumeric(40);
                        const id = await db.friends.add({ ...friend, id: fakeId });

                        expect(id).toBe(fakeId);
                    });
                });
                describe('Put()', () => {
                    it('should generate hashed id if not provided', async () => {
                        const [friend] = mockFriends(1);
                        const id = await db.friends.put(friend);

                        const expectedId = Encryption.hash(friend);
                        expect(id).toBe(expectedId);
                    });
                    it('should keep provided id when provided', async () => {
                        const [friend] = mockFriends(1);
                        const fakeId = 'mock-id: ' + faker.random.alphaNumeric(40);
                        const id = await db.friends.put({ ...friend, id: fakeId });

                        expect(id).toBe(fakeId);
                    });
                    it('should not overwrite id on update', async () => {
                        const [friend] = mockFriends(1);
                        const id = await db.friends.put(friend);

                        const getFriend = await db.friends.get(id);
                        expect(getFriend).toEqual({ ...friend, id });

                        const [friend2] = mockFriends(1);
                        const id2 = await db.friends.put({ ...friend2, id });

                        const getFriend2 = await db.friends.get(id);
                        expect(id).toBe(id2);
                        expect(getFriend2).toEqual({ ...friend2, id });
                    });
                });
                describe('Update()', () => {
                    it('should not overwrite id on update', async () => {
                        const [friend] = mockFriends(1);
                        const id = await db.friends.add(friend);

                        const getFriend = await db.friends.get(id) as Friend;
                        const updatedDoc: Friend = { ...getFriend, firstName: 'mock name' };
                        await db.friends.update(id, updatedDoc);

                        const getFriend2 = await db.friends.get(id) as Friend;
                        expect(getFriend2.id).toBe(id);
                    });
                });
            });
            describe('Add()', () => {
                it('should be able to add() and get() friend', async () => {
                    const [friend] = mockFriends(1);
                    const id = await db.friends.add(friend);

                    const getFriend = await db.friends.get(id);
                    expect(getFriend).toEqual({ ...friend, id });
                });
                it('should be able to bulkAdd() and get() friends', async () => {
                    const friends = mockFriends();
                    await db.friends.bulkAdd(friends);
                    const hashedIds = friends.map(friend => Encryption.hash(friend));
                    const hashedDocuments = friends.map((friend, i) => ({ ...friend, id: hashedIds[i] }));

                    /* For v3 of Dezie */
                    // const getFriends = await db.friends.bulkGet(hashedIds);
                    const getFriends = await Promise.all(hashedIds.map(id => db.friends.get(id)));
                    expect(getFriends).toEqual(hashedDocuments);
                });
                it('should be able to add() partial friend and get() partial friend', async () => {
                    const [friend] = mockFriends(1);
                    const { shoeSize, ...partialFriend } = friend;
                    const id = await db.friends.add(partialFriend as Friend);

                    const getFriend = await db.friends.get(id);
                    expect(getFriend).toEqual({ ...partialFriend, id } as Friend);
                });
            });
            describe('Put()', () => {
                describe('Create', () => {
                    it('should be able to put() and get() friend', async () => {
                        const [friend] = mockFriends(1);
                        const id = await db.friends.put(friend);

                        const getFriend = await db.friends.get(id);
                        expect(getFriend).toEqual({ ...friend, id });
                    });
                    it('should be able to bulkPut() and get() friends', async () => {
                        const friends = mockFriends();
                        await db.friends.bulkPut(friends);
                        const hashedIds = friends.map(friend => Encryption.hash(friend));
                        const hashedDocuments = friends.map((friend, i) => ({ ...friend, id: hashedIds[i] }));

                        /*
                        * For v3 of Dezie
                        */
                        // const getFriends = await db.friends.bulkGet(hashedIds);
                        const getFriends = await Promise.all(hashedIds.map(id => db.friends.get(id)));
                        expect(getFriends).toEqual(hashedDocuments);
                    });
                });
                describe('Overwrite', () => {
                    it('should be able to overwrite document when id exists', async () => {
                        const [friend] = mockFriends(1);
                        const id = await db.friends.put(friend);

                        const getFriend = await db.friends.get(id);
                        expect(getFriend).toEqual({ ...friend, id });

                        const [friend2] = mockFriends(1);
                        await db.friends.put({ ...friend2, id });

                        const getFriend2 = await db.friends.get(id);
                        expect(getFriend2).toEqual({ ...friend2, id });
                    });
                    it('should be able to bulkPut() and get() friends', async () => {
                        const friends = mockFriends();
                        await db.friends.bulkPut(friends);
                        const hashedIds = friends.map(friend => Encryption.hash(friend));
                        const hashedDocuments = friends.map((friend, i) => ({ ...friend, id: hashedIds[i] }));

                        /*
                        * For v3 of Dezie
                        */
                        // const getFriends = await db.friends.bulkGet(hashedIds);
                        const getFriends = await Promise.all(hashedIds.map(id => db.friends.get(id)));
                        expect(getFriends).toEqual(hashedDocuments);

                        const friends2 = mockFriends();
                        const hashedDocuments2 = friends2.map((friend, i) => ({ ...friend, id: hashedIds[i] }));
                        await db.friends.bulkPut(hashedDocuments2);

                        /*
                        * For v3 of Dezie
                        */
                        // const getFriends = await db.friends.bulkGet(hashedIds);
                        const getFriends2 = await Promise.all(hashedIds.map(id => db.friends.get(id)));
                        expect(getFriends2).toEqual(hashedDocuments2);
                    });
                });
            });
            describe('Update()', () => {
                let id: string;
                beforeEach(async () => {
                    const [friend] = mockFriends(1);
                    id = await db.friends.add(friend);
                });
                it('should be able to update document', async () => {
                    const getFriend = await db.friends.get(id) as Friend;

                    const updatedDoc: Friend = { ...getFriend, firstName: 'mock name' };
                    await db.friends.update(id, updatedDoc);

                    const getFriend2 = await db.friends.get(id);
                    expect(getFriend2).toEqual(updatedDoc);
                });
                it('should be able to add to the document', async () => {
                    const getFriend = await db.friends.get(id) as Friend;

                    const updatedDoc: Friend = { ...getFriend, testProp: 'testie' };
                    await db.friends.update(id, updatedDoc);

                    const getFriend2 = await db.friends.get(id);
                    expect(getFriend2).toEqual(updatedDoc);
                });
                it('should be able to remove from the document', async () => {
                    const getFriend = await db.friends.get(id) as Friend;

                    const updatedDoc: Friend = { ...getFriend, shoeSize: undefined } as any;
                    const test = await db.friends.update(id, updatedDoc);

                    const getFriend2 = await db.friends.get(id);

                    const { shoeSize, ...expectedDoc } = updatedDoc;
                    expect(test).toBe(1);
                    expect(getFriend2).toEqual(expectedDoc as any);
                });
            });
            describe('Get()', () => {
                let friendsRead: Friend[];
                let id: string;
                beforeEach(async () => {
                    friendsRead = mockFriends();
                    id = await db.friends.bulkAdd(friendsRead);
                });
                it('should be able to get the decrypted document', async () => {
                    const friend = await db.friends.get(id);
                    expect(friend).toEqual({ ...friendsRead[4], id });
                });
            });
            describe('Where()', () => {
                let friendsRead: Friend[];
                let friendsWithIds: Friend[];
                beforeEach(async () => {
                    friendsRead = mockFriends();
                    await db.friends.bulkAdd(friendsRead);
                    friendsWithIds = friendsRead.map(friend => ({ ...friend, id: Encryption.hash(friend) }));
                });
                it('should be able to get decrypted documents', async () => {
                    const friends = await db.friends.where('age')
                        .between(1, 80, true, true).toArray();
                    expect(friends).toEqual(jasmine.arrayContaining(friendsWithIds));
                });
            });
        });
    });
    describe('Negative', () => {
        describe('Faulty databases', () => {
            // Faulty databases should throw
            databasesNegative.forEach(database => {
                let db: ReturnType<typeof database.db>;
                beforeEach(async () => {
                    db = database.db();
                });
                afterEach(async () => {
                    await db.delete();
                });
                describe(database.desc, () => {
                    it('should throw when no encryption keys are set', async () => {
                        expectAsync(db.open()).toBeRejectedWithError('No encryption keys are set');
                    });
                });
            });
        });
        it('should not override create methods if immutable is set to false', async () => {
            spyOn(immutable, 'immutable').and.callThrough();
            const db = new TestDatabaseNotImmutable('TestDatabaseNotImmutable');
            const [friend] = mockFriends(1);

            await db.open();
            await db.friends.add(friend);
            expect(immutable.immutable).not.toHaveBeenCalled();
            await db.delete();
        });
    });
});
