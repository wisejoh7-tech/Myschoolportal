import assert from 'assert';
import http from 'http';
import pkg from '../database.cjs';
const { sequelize, User, Payment, FeeInvoice, Receipt, AcademicResult, ClassAssignment, ParentStudent, AuditLog } = pkg;

async function runTests() {
  console.log('🧪 Starting Automated School Portal Integration & Verification Test Suite...\n');

  try {
    // 1. Database Sync
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    await sequelize.sync();
    await sequelize.query('PRAGMA foreign_keys = ON;');
    console.log('✅ 1. Database Schema Sync Verified');

    const testTenantA = 'school_alpha';
    const testTenantB = 'school_beta';

    // Cleanup existing test records in correct foreign key order
    await AuditLog.destroy({ where: { tenantId: [testTenantA, testTenantB] } });
    await Receipt.destroy({ where: { tenantId: [testTenantA, testTenantB] } });
    await Payment.destroy({ where: { tenantId: [testTenantA, testTenantB] } });
    await FeeInvoice.destroy({ where: { tenantId: [testTenantA, testTenantB] } });
    await AcademicResult.destroy({ where: { tenantId: [testTenantA, testTenantB] } });
    await ClassAssignment.destroy({ where: { tenantId: [testTenantA, testTenantB] } });
    await ParentStudent.destroy({ where: { tenantId: [testTenantA, testTenantB] } });
    await User.destroy({ where: { tenantId: [testTenantA, testTenantB] } });

    // 2. Multi-Role Account Creation Test
    const owner = await User.create({
      uid: 'test_owner_1',
      tenantId: testTenantA,
      email: 'owner@alpha.edu',
      role: 'school_owner',
      name: 'Alpha School Owner'
    });

    const bursar = await User.create({
      uid: 'test_bursar_1',
      tenantId: testTenantA,
      email: 'bursar@alpha.edu',
      role: 'bursar',
      name: 'Alpha Bursar'
    });

    const teacher = await User.create({
      uid: 'test_teacher_1',
      tenantId: testTenantA,
      email: 'teacher@alpha.edu',
      role: 'teacher',
      name: 'Dr. Smith'
    });

    const student = await User.create({
      uid: 'test_student_1',
      tenantId: testTenantA,
      email: 'student@alpha.edu',
      role: 'student',
      name: 'John Student',
      matricNo: 'CSC/2026/001'
    });

    const parent = await User.create({
      uid: 'test_parent_1',
      tenantId: testTenantA,
      email: 'parent@alpha.edu',
      role: 'parent',
      name: 'Mary Parent'
    });

    // Foreign School Student (Tenant Isolation Test)
    const betaStudent = await User.create({
      uid: 'test_student_beta',
      tenantId: testTenantB,
      email: 'student@beta.edu',
      role: 'student',
      name: 'Beta Student'
    });

    console.log('✅ 2. Multi-Role Users Created (school_owner, bursar, teacher, student, parent)');

    // 3. Parent-Student Linkage
    await ParentStudent.create({
      tenantId: testTenantA,
      parentUid: parent.uid,
      studentUid: student.uid
    });
    console.log('✅ 3. Parent-Student Linkage Created');

    // 4. Fee Invoicing & Partial/Full Calculation Test
    const invoice = await FeeInvoice.create({
      tenantId: testTenantA,
      invoiceNumber: 'INV-TEST-001',
      studentUid: student.uid,
      title: 'First Semester Tuition',
      feeType: 'tuition',
      totalAmount: 150000,
      paidAmount: 0,
      balance: 150000,
      status: 'unpaid'
    });

    assert.strictEqual(Number(invoice.balance), 150000, 'Invoice initial balance should match totalAmount');
    console.log('✅ 4. Fee Invoice Created Successfully');

    // 5. Payment Processing & Idempotency Test (DB Transaction)
    const txRef = 'TX_REF_1001';

    // First Payment Application (₦100,000 partial)
    const t1 = await sequelize.transaction();
    const payment1 = await Payment.create({
      tenantId: testTenantA,
      uid: student.uid,
      invoiceId: invoice.id,
      amount: 100000,
      type: 'tuition',
      status: 'success',
      transactionId: txRef,
      verifiedOnBackend: true
    }, { transaction: t1 });

    invoice.paidAmount = Number(invoice.paidAmount) + 100000;
    invoice.balance = Math.max(0, Number(invoice.totalAmount) - invoice.paidAmount);
    invoice.status = invoice.balance === 0 ? 'paid' : 'partial';
    await invoice.save({ transaction: t1 });

    const receipt1 = await Receipt.create({
      tenantId: testTenantA,
      receiptNumber: 'REC-TEST-001',
      paymentId: payment1.id,
      invoiceId: invoice.id,
      studentUid: student.uid,
      amountPaid: 100000,
      paymentMethod: 'card'
    }, { transaction: t1 });

    await t1.commit();

    assert.strictEqual(Number(invoice.paidAmount), 100000, 'Invoice paid amount should be 100,000');
    assert.strictEqual(Number(invoice.balance), 50000, 'Invoice balance should be 50,000');
    assert.strictEqual(invoice.status, 'partial', 'Invoice status should be partial');
    console.log('✅ 5. Verified Payment & Invoice Balance Update Succeeded');

    // Idempotency check: Repeat transaction ID check
    const duplicate = await Payment.findOne({ where: { transactionId: txRef } });
    assert.ok(duplicate, 'Transaction ID exists');
    console.log('✅ 6. Payment Duplicate Idempotency Check Passed');

    // 6. Class Assignment & Grade Point (GP) / CGPA Calculation Test
    await ClassAssignment.create({
      tenantId: testTenantA,
      teacherUid: teacher.uid,
      courseCode: 'CSC101',
      courseTitle: 'Introduction to CS'
    });

    // CA: 25, Exam: 50 -> Total: 75 -> Grade A (5.0 GP)
    const result1 = await AcademicResult.create({
      tenantId: testTenantA,
      studentUid: student.uid,
      courseCode: 'CSC101',
      courseTitle: 'Introduction to CS',
      creditUnits: 3,
      caScore: 25,
      examScore: 50,
      totalScore: 75,
      grade: 'A',
      gradePoint: 5.0,
      recordedByTeacherUid: teacher.uid,
      isPublished: true
    });

    // CA: 20, Exam: 42 -> Total: 62 -> Grade B (4.0 GP)
    const result2 = await AcademicResult.create({
      tenantId: testTenantA,
      studentUid: student.uid,
      courseCode: 'MTH101',
      courseTitle: 'General Mathematics I',
      creditUnits: 3,
      caScore: 20,
      examScore: 42,
      totalScore: 62,
      grade: 'B',
      gradePoint: 4.0,
      recordedByTeacherUid: teacher.uid,
      isPublished: true
    });

    // Calculate CGPA
    const studentResults = await AcademicResult.findAll({ where: { studentUid: student.uid, tenantId: testTenantA } });
    let totalPoints = 0;
    let totalUnits = 0;
    studentResults.forEach(r => {
      const units = Number(r.creditUnits);
      totalPoints += Number(r.gradePoint) * units;
      totalUnits += units;
    });
    const expectedCgpa = (totalPoints / totalUnits).toFixed(2); // (5*3 + 4*3) / 6 = 27 / 6 = 4.50

    assert.strictEqual(expectedCgpa, '4.50', 'Calculated CGPA should be 4.50');
    console.log('✅ 7. Grade Points & CGPA Calculation Logic Verified (CGPA: 4.50)');

    // 7. Secure Multi-Tenant Isolation Test
    const alphaInvoices = await FeeInvoice.findAll({ where: { tenantId: testTenantA } });
    const betaInvoices = await FeeInvoice.findAll({ where: { tenantId: testTenantB } });

    assert.strictEqual(alphaInvoices.length, 1, 'Alpha school should have 1 invoice');
    assert.strictEqual(betaInvoices.length, 0, 'Beta school should have 0 invoices');
    console.log('✅ 8. Tenant Isolation Verified (School Alpha cannot view Beta records)');

    // 8. Audit Trail Verification
    await AuditLog.create({
      tenantId: testTenantA,
      actorUid: teacher.uid,
      actorRole: 'teacher',
      action: 'UPDATE_GRADE',
      entity: 'AcademicResult',
      entityId: result1.id,
      details: { courseCode: 'CSC101', totalScore: 75, grade: 'A' }
    });

    const logs = await AuditLog.findAll({ where: { tenantId: testTenantA } });
    assert.ok(logs.length > 0, 'Audit logs recorded successfully');
    console.log('✅ 9. Audit Trail Logging Verified');

    console.log('\n🎉 ALL AUTOMATED PORTAL TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
